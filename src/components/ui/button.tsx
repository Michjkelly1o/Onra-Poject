import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// ─── Onra Design System — Button component ───────────────────────────────────
//
// Variants (hierarchy):
//   primary        — sage green bg (#c4edd6), dark text  [DS: Primary]
//   secondary-gray — white bg, gray border               [DS: Secondary gray]
//   tertiary-gray  — transparent bg, no border           [DS: Tertiary gray]
//   destructive    — red bg, white text                  [DS: custom]
//   link-color     — no bg, brand-color text             [DS: Link color]
//   link-gray      — no bg, gray text                    [DS: Link gray]
//
// Aliases kept for shadcn backward-compat:
//   default → primary | outline → secondary-gray | ghost → tertiary-gray
//   secondary → secondary-gray | link → link-color
//
// Sizes: sm (36px) | md/default (40px) | lg (44px) | xl (48px) | icon

const buttonVariants = cva(
    // Base classes — applied to all variants
    [
        "inline-flex items-center justify-center gap-[4px]",
        "font-semibold text-[14px] leading-[20px] whitespace-nowrap",
        "rounded-[8px]",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4b8c9a] focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    ].join(" "),
    {
        variants: {
            variant: {
                // ── Figma DS: Primary ──────────────────────────────────────
                // bg: secondary/200 #c4edd6 | hover: secondary/300 #aad4bd | fg: black
                primary: [
                    "bg-[#c4edd6] border-1 border-white/[0.12] text-[#0c2d34]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.10),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#aad4bd] active:bg-[#92baa4]",
                ],
                default: [
                    "bg-[#c4edd6] border-1 border-white/[0.12] text-[#0c2d34]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#aad4bd] active:bg-[#92baa4]",
                ],

                // ── Figma DS: Secondary gray ───────────────────────────────
                // bg: white | border: #d0d5dd | fg: #344054
                "secondary-gray": [
                    "bg-white border-1 border-[#d0d5dd] text-[#344054]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#f9fafb] hover:text-[#18212f] active:bg-[#f2f4f7]",
                ],
                outline: [
                    "bg-white border-1 border-[#d0d5dd] text-[#344054]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#f9fafb] hover:text-[#18212f] active:bg-[#f2f4f7]",
                ],
                secondary: [
                    "bg-white border-1 border-[#d0d5dd] text-[#344054]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#f9fafb] hover:text-[#18212f] active:bg-[#f2f4f7]",
                ],

                // ── Figma DS: Tertiary gray ────────────────────────────────
                // fg: #475467 | hover fg: #344054 | hover bg: #f9fafb
                "tertiary-gray": [
                    "bg-transparent text-[#475467]",
                    "hover:bg-[#f9fafb] hover:text-[#344054] active:bg-[#f2f4f7]",
                ],
                ghost: [
                    "bg-transparent text-[#475467]",
                    "hover:bg-[#f9fafb] hover:text-[#344054] active:bg-[#f2f4f7]",
                ],

                // ── Figma DS: Destructive Primary ──────────────────────────
                // bg: #d92c20 | hover: #b32218 | fg: white
                destructive: [
                    "bg-[#d92c20] border-1 border-white/[0.12] text-white",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#b32218] active:bg-[#901f17]",
                ],

                // ── Figma DS: Destructive Secondary ───────────────────────
                // Error-50 tinted fill (matches the Cancel-booking action) — the
                // single main destructive button used across the customer app.
                // bg: #fef3f2 | border: #fda29b | fg: #b42318 | hover bg: #fee4e2
                "destructive-secondary": [
                    "bg-[#fef3f2] border-1 border-[#fda29b] text-[#b42318]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#fee4e2] hover:text-[#912018] active:bg-[#fee4e2] active:text-[#912018]",
                ],

                // ── Figma DS: Destructive Tertiary ────────────────────────
                // fg: #b32218 | hover fg: #901f17 | hover bg: #fef2f1
                "destructive-tertiary": [
                    "bg-transparent text-[#b32218]",
                    "hover:bg-[#fef2f1] hover:text-[#901f17] active:bg-[#fee3e1]",
                ],

                // ── Figma DS: Link color ───────────────────────────────────
                "link-color": [
                    "bg-transparent text-[#4b8c9a] rounded-none h-auto px-0",
                    "hover:text-[#306b78] hover:underline underline-offset-4",
                ],
                link: [
                    "bg-transparent text-[#4b8c9a] rounded-none h-auto px-0",
                    "hover:text-[#306b78] hover:underline underline-offset-4",
                ],

                // ── Figma DS: Link gray ────────────────────────────────────
                "link-gray": [
                    "bg-transparent text-[#667085] rounded-none h-auto px-0",
                    "hover:text-[#344054] hover:underline underline-offset-4",
                ],

                // ── Figma DS: Destructive Link ─────────────────────────────
                "destructive-link": [
                    "bg-transparent text-[#d92c20] rounded-none h-auto px-0",
                    "hover:text-[#b32218] hover:underline underline-offset-4",
                ],
            },
            size: {
                // Figma DS sizes
                sm: "h-9 px-[14px]",          // 36px
                md: "h-10 px-[14px]",          // 40px
                lg: "h-11 px-[16px]",          // 44px
                xl: "h-12 px-[20px] text-base leading-6", // 48px
                // shadcn compat
                default: "h-10 px-[14px]",     // = md
                icon: "h-10 w-10 p-0",
                "icon-sm": "h-9 w-9 p-0",
                "icon-lg": "h-11 w-11 p-0",
            },
        },
        defaultVariants: {
            variant: "secondary-gray",
            size: "md",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant,
            size,
            asChild = false,
            leftIcon,
            rightIcon,
            loading = false,
            disabled,
            children,
            ...props
        },
        ref
    ) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                ref={ref}
                className={cn(buttonVariants({ variant, size }), className)}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? (
                    <svg
                        className="w-4 h-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                    >
                        <circle
                            className="opacity-25"
                            cx="12" cy="12" r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                ) : (
                    <>
                        {leftIcon && (
                            <span className="w-5 h-5 flex items-center justify-center shrink-0">
                                {leftIcon}
                            </span>
                        )}
                        {children}
                        {rightIcon && (
                            <span className="w-5 h-5 flex items-center justify-center shrink-0">
                                {rightIcon}
                            </span>
                        )}
                    </>
                )}
            </Comp>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }

/*
Usage examples:

// Primary (sage green — Figma DS default action)
<Button variant="primary">Save changes</Button>
<Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>Add class</Button>
<Button variant="primary" loading>Saving...</Button>

// Secondary gray (white with border — less prominent action)
<Button variant="secondary-gray">Cancel</Button>
<Button variant="outline">Cancel</Button>  // same — shadcn alias

// Tertiary gray (ghost — minimal action)
<Button variant="tertiary-gray">View all</Button>
<Button variant="ghost">View all</Button>   // same — shadcn alias

// Destructive (danger action)
<Button variant="destructive">Delete member</Button>
<Button variant="destructive" leftIcon={<Trash01 className="w-4 h-4" />}>Delete</Button>

// Links
<Button variant="link-color">Learn more</Button>
<Button variant="link-gray">Dismiss</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra large</Button>

// Icon only
<Button variant="secondary-gray" size="icon"><Plus className="w-4 h-4" /></Button>
*/
